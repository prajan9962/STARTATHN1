export interface ApprovedParticipantEntry {
  email: string;
  fullName?: string;
  department?: string;
}

export interface VerificationConfig {
  /**
   * Set to true to restrict certificate generation to the approved participant list below.
   * When false, any student entering valid details can generate their participation certificate.
   */
  enabled: boolean;
  /**
   * List of approved participant email addresses (case-insensitive).
   */
  approvedEmails: string[];
  /**
   * Optional structured participant entries for stricter email + name verification.
   */
  approvedEntries: ApprovedParticipantEntry[];
}

export const VERIFICATION_CONFIG: VerificationConfig = {
  enabled: false,
  approvedEmails: [
    // Add registered participant emails here when enabling verification:
    // 'aarav.cse@stjosephs.ac.in',
    // 'priya.it@stjosephs.ac.in',
  ],
  approvedEntries: [],
};

export interface VerificationResult {
  verified: boolean;
  errorMessage?: string;
}

export function verifyParticipantEligibility(
  fullName: string,
  email: string
): VerificationResult {
  if (!VERIFICATION_CONFIG.enabled) {
    return { verified: true };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = fullName.trim().toLowerCase();

  const matchesEmailList = VERIFICATION_CONFIG.approvedEmails.some(
    (entry) => entry.trim().toLowerCase() === normalizedEmail
  );

  const matchesStructuredEntry = VERIFICATION_CONFIG.approvedEntries.some(
    (entry) => {
      if (entry.email.trim().toLowerCase() !== normalizedEmail) return false;
      if (entry.fullName && entry.fullName.trim().toLowerCase() !== normalizedName) {
        return false;
      }
      return true;
    }
  );

  if (matchesEmailList || matchesStructuredEntry) {
    return { verified: true };
  }

  return {
    verified: false,
    errorMessage:
      "This email address is not on the approved STARTATHON 2026 participant list. Please enter the email you used during event registration or contact the Students' Council.",
  };
}
