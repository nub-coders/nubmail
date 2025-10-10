import { pgQuery } from './postgres';

export async function verifyAdminUsers() {
  // Set email_verified=true for all admin users
  await pgQuery('UPDATE users SET email_verified = true WHERE is_admin = true');
  console.log('[verify-admins] All admin users marked as verified');
}
