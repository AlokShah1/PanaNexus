import { db } from '../../prisma/db.js';

export async function getAnalytics() {
  const [users, appointments, emergencies, ambulances, bloodUnits, bloodRequests, bloodDonors, feedbacks, auditLogs, doctors, facilities, patients] = await Promise.all([
    db.orm.public.User.all(),
    db.orm.public.Appointment.all(),
    db.orm.public.EmergencyRequest.all(),
    db.orm.public.Ambulance.all(),
    db.orm.public.BloodUnit.all(),
    db.orm.public.BloodRequest.all(),
    db.orm.public.BloodDonor.all(),
    db.orm.public.Feedback.all(),
    db.orm.public.AuditLog.all(),
    db.orm.public.Doctor.all(),
    db.orm.public.HealthcareFacility.all(),
    db.orm.public.Patient.all(),
  ]);

  const byRole: Record<string, number> = {};
  for (const u of users) byRole[u.role] = (byRole[u.role] ?? 0) + 1;

  const countBy = (list: { status: string }[]) => {
    const m: Record<string, number> = {};
    for (const r of list) m[r.status] = (m[r.status] ?? 0) + 1;
    return m;
  };

  const feedbackRatings = feedbacks.map((f) => f.rating).filter((r) => typeof r === 'number');
  const averageRating = feedbackRatings.length ? feedbackRatings.reduce((a, b) => a + b, 0) / feedbackRatings.length : null;

  return {
    users: { total: users.length, byRole },
    patients: patients.length,
    doctors: doctors.length,
    facilities: facilities.length,
    appointments: { total: appointments.length, byStatus: countBy(appointments) },
    emergency: {
      total: emergencies.length,
      active: emergencies.filter((e) => e.status !== 'COMPLETED' && e.status !== 'CANCELLED').length,
      byStatus: countBy(emergencies),
    },
    ambulances: { total: ambulances.length, available: ambulances.filter((a) => a.status === 'AVAILABLE').length, byStatus: countBy(ambulances) },
    blood: { totalUnits: bloodUnits.reduce((s, u) => s + (u.units || 0), 0), pendingRequests: bloodRequests.filter((r) => r.status === 'PENDING').length, availableDonors: bloodDonors.filter((d) => d.isAvailable).length },
    feedback: { averageRating, count: feedbackRatings.length },
    auditLogs: auditLogs.length,
  };
}
