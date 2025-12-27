-- Add new application status for site visit payment completion
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'pre_visit_approved';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'site_visit_payment_completed';
