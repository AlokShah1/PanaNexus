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

`local` is the default. In production the server logs a warning if it is left
on `local`; use `s3` for any real patient document.

## Configuration

Backend environment variables (never expose these to the frontend):

```
STORAGE_DRIVER=s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=pananexus-medical-reports
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
REPORT_MAX_FILE_BYTES=15728640   # 15 MB (default)
REPORT_URL_TTL_SECONDS=300       # signed download lifetime (default)
```

When `STORAGE_DRIVER=s3`, `AWS_REGION` and `AWS_S3_BUCKET` are required. The
access key pair is optional at validation time so an instance/profile role can
be used instead; if one of the pair is set, both must be.

## Bucket setup (AWS S3)

1. **Create the bucket** in your region, e.g. `pananexus-medical-reports`.
2. **Block all public access** — leave "Block all public access" enabled. Never
   add a public bucket policy or ACL; objects are reached only through presigned
   URLs.
3. **Encrypt by default** — the API requests `ServerSideEncryption=AES256`
   (SSE-S3) on every upload. You may instead enable SSE-KMS or a bucket default.
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

   Put the resulting key/secret in `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
   as backend env vars only.

6. **CORS** — if the web app downloads the report by fetching the presigned URL
   in JavaScript (blob download), add a bucket CORS rule allowing `GET` from the
   web origin:

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

   If the browser instead navigates to / downloads the URL directly, CORS is not
   required.

7. **Lifecycle / retention** — set lifecycle rules that match your data policy.
   Deleted reports are soft-deleted in the database and the object is removed;
   enable versioning + a noncurrent-version expiry rule if you keep backups.

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
