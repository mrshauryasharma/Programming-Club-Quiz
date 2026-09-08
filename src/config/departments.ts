/**
 * PROGRAMMING CLUB QUIZ — OFFICIAL DEPARTMENTS CONFIGURATION
 *
 * Official 27 department programs for Gautam Buddha University (SOICT).
 * Sourced from official university department offerings.
 */

export const OFFICIAL_DEPARTMENTS: string[] = [
  'B.Tech CSE',
  'B.Tech CSE AI',
  'B.Tech CSE Cyber Security',
  'B.Tech CSE Data Science',
  'B.Tech ECE',
  'B.Tech ECE(AI & ML)',
  'B.Tech ECE(VLSI)',
  'B.Tech IT',
  'B.Tech DS & ML',
  'Integrated B.Tech-M.Tech CSE',
  'Integrated B.Tech-M.Tech CSE AI and Robotics',
  'Integrated B.Tech-M.Tech CSE SE',
  'Integrated B.Tech-M.Tech CSE DS',
  'Integrated B.Tech-M.Tech ECE',
  'Integrated B.Tech-M.Tech ECE AI and Robotics',
  'Integrated B.Tech-M.Tech ECE VLSI Design',
  'Integrated B.Tech-M.Tech ECE WCN',
  'BCA',
  'BCA (AI & ML)',
  'MCA',
  'M.Tech CSE',
  'M.Tech CSE (SE)',
  'M.Tech CSE (AI & Robotics)',
  'M.Tech CSE (DS)',
  'Ph.D CSE',
  'Ph.D ECE',
  'Ph.D IT',
];

/**
 * Helper to check if official departments have been configured.
 */
export const isDepartmentsConfigured = (): boolean => {
  return OFFICIAL_DEPARTMENTS.length > 0;
};
