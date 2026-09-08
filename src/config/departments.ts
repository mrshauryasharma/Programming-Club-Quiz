/**
 * PROGRAMMING CLUB QUIZ — OFFICIAL DEPARTMENTS CONFIGURATION
 *
 * NOTE: The official 27 department names for Gautam Buddha University / SOICT
 * will be inserted into the OFFICIAL_DEPARTMENTS array below.
 *
 * DO NOT add fake or fabricated department names.
 * When the official list is received, paste the 27 strings into this array.
 */

export const OFFICIAL_DEPARTMENTS: string[] = [
  // INSERT OFFICIAL 27 DEPARTMENT NAMES HERE:
  // e.g.:
  // "Department of Computer Science and Engineering",
  // "Department of Information Technology",
  // ...
];

/**
 * Helper to check if official departments have been configured.
 */
export const isDepartmentsConfigured = (): boolean => {
  return OFFICIAL_DEPARTMENTS.length > 0;
};
