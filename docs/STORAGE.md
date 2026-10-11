# Private medical report storage

Patient medical reports (medical records, lab results, prescriptions, imaging
reports, discharge summaries) are stored as **private objects**: the bucket is
never public, the API never returns a permanent URL, and every download goes
through an authorization check before a short-lived signed URL is issued.

Binaries live in the object store. Only metadata (category, filenames, MIME
type, size, checksum, storage key) is persisted in PostgreSQL via the
`ReportFile` model.

## Drivers

Selected with `STORAGE_DRIVER`:

| Driver  | Use case | Download mechanism |
| ------- | -------- | ------------------ |
| `local` | Development / test / single self-hosted box | Backend streams the file from `UPLOAD_DIR/reports` behind an HMAC-signed, expiring URL |
| `s3`    | Production | S3 presigned `GetObject` URL (default TTL 5 min) |

`local` is the default for development/test. **In production the API refuses
to boot unless `STORAGE_DRIVER=s3` and the S3 variables below are set** — local
disk on an ephemeral host would silently lose patient documents on redeploy.
The startup check names any missing variable and never prints secret values.

## Configuration

Backend environment variables (never expose these to the frontend):

```
STORAGE_DRIVER=s3
S3_REGION=us-east-1
S3_BUCKET=pananexus-medical-reports
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://s3.filebase.com
REPORT_MAX_FILE_BYTES=15728640   # 15 MB (default)
REPORT_URL_TTL_SECONDS=300       # signed download lifetime (default)
```

When `STORAGE_DRIVER=s3`, `S3_REGION` and `S3_BUCKET` are required. In
production the access key pair (`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`)
is required too — an instance/profile role is accepted only outside production.
Missing values abort startup with an actionable message that names the variables
but never their values.

**Filebase-specific notes:**
- Set `S3_ENDPOINT=https://s3.filebase.com` for Filebase.
- Use `S3_REGION=us-east-1` (Filebase primary region).
- Create the bucket in the Filebase dashboard (e.g. `pananexus-medical-reports`).
- The bucket **must remain private** — never enable public access.
- Filebase free tier: 5 GB storage, 1 GB/month egress, 100,000 requests/month.
- Exceeding free-tier limits will cause uploads/downloads to fail; the API returns
  clear errors and does not delete existing files.

## Production deployment steps

1. Create the bucket and a least-privilege access key (see below).
2. In the Render dashboard set `STORAGE_DRIVER=s3` plus `S3_REGION`,
   `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` as **secret**
   environment variables (never commit them or expose them to the frontend).
3. Set `S3_ENDPOINT=https://s3.filebase.com` when using Filebase (omit it for AWS S3).
4. Deploy. The API refuses to boot in production while any of these is missing;
   `render.yaml` already selects S3 and leaves the credentials to the dashboard.
5. Enable a lifecycle/retention policy that matches your data policy.
6. If the browser fetches the presigned URL in JavaScript, add the bucket CORS
   rule from the "Bucket setup" section below.
7. Migrating from `local`: copy existing `UPLOAD_DIR/reports` objects into the
   bucket under their stored keys first. The app never migrates or deletes your
   existing files automatically.

## Bucket setup (Filebase / AWS S3 compatible)

### Filebase (recommended for free-tier development)

1. **Create a Filebase account** at https://filebase.com/ and create a bucket (e.g. `pananexus-medical-reports`).
2. **Keep the bucket private** — Filebase buckets are private by default. Never enable public access.
3. **Create an access key** in the Filebase dashboard (Access Keys → Create Access Key).
4. **Configure environment variables**:
   ```
   STORAGE_DRIVER=s3
   S3_REGION=us-east-1
   S3_BUCKET=pananexus-medical-reports
   S3_ENDPOINT=https://s3.filebase.com
   S3_ACCESS_KEY_ID=<your-filebase-access-key>
   S3_SECRET_ACCESS_KEY=<your-filebase-secret-key>
   ```
5. **Enable versioning** (recommended) in the Filebase dashboard so accidental deletes are recoverable.
6. **CORS** — if the web app downloads the report by fetching the presigned URL in JavaScript (blob download), add a bucket CORS rule allowing `GET` from the web origin (Filebase dashboard → Bucket → CORS):
   ```json
   [
     {
       "AllowedMethods": ["GET"],
       "AllowedOrigins": ["https://<your-web-host>"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
7. **Lifecycle / retention** — set lifecycle rules that match your data policy. Deleted reports are soft-deleted in the database and the object is removed; enable versioning + a noncurrent-version expiry rule if you keep backups.

### AWS S3 (alternative)

1. **Create the bucket** in your region, e.g. `pananexus-medical-reports`.
2. **Block all public access** — leave "Block all public access" enabled. Never add a public bucket policy or ACL; objects are reached only through presigned URLs.
3. **Encrypt by default** — the API requests `ServerSideEncryption=AES256` (SSE-S3) on every upload. You may instead enable SSE-KMS or a bucket default.
4. **Enable versioning** (recommended) so accidental deletes are recoverable.
5. **Create a least-privilege IAM user** used only by the API:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::pananexus-medical-reports/*"
       },
       {
         "Effect": "Allow",
         "Action": ["s3:ListBucket"],
         "Resource": "arn:aws:s3:::pananexus-medical-reports"
       }
     ]
   }
   ```
   Put the resulting key/secret in `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` as backend env vars only.
6. **CORS** — if the web app downloads the report by fetching the presigned URL in JavaScript (blob download), add a bucket CORS rule allowing `GET` from the web origin.
7. **Lifecycle / retention** — set lifecycle rules that match your data policy. Deleted reports are soft-deleted in the database and the object is removed; enable versioning + a noncurrent-version expiry rule if you keep backups.

## Security properties

- Bucket is private; no permanent public URLs are ever produced.
- Every `GET /api/v1/reports/:id/download` re-checks the caller's access to the
  patient before signing a URL, and records an audit entry.
- Uploads validate filename (basename only, length), size, declared MIME type,
  and the real file signature (PDF/JPEG/PNG/WebP) — a renamed or spoofed file is
  rejected.
- Signed URLs are short-lived and possession-scoped; the local driver uses an
  HMAC over `key|expiry|filename` and rejects tampered or expired links.
- Demo/synthetic objects are written under a `demo/` prefix and flagged
  `isDemo=true`, keeping them separate from real patient documents.

## Demo data

Synthetic demo reports are seeded with `isDemo=true`, a `demo/` storage key
prefix, and are distinct from anything a real user uploads.
