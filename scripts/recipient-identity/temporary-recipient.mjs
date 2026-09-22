const CLERK_USERS_URL = "https://api.clerk.com/v1/users";

export function temporaryRecipientEmail(baseEmail, nonce) {
  const match = /^([^@\s]+)\+clerk_test@([^@\s]+)$/i.exec(baseEmail);
  if (!match || !/^[a-f0-9]{16}$/.test(nonce)) {
    throw new Error("Temporary recipient requires a declared Clerk test address and a fresh nonce.");
  }
  return `${match[1]}+clerk_test_${nonce}@${match[2]}`.toLowerCase();
}

export async function createTemporaryRecipient({ secretKey, email, password, request = fetch }) {
  if (!secretKey?.startsWith("sk_test_") || !/\+clerk_test_[a-f0-9]{16}@/i.test(email) || password?.length < 24) {
    throw new Error("Temporary recipient target is invalid.");
  }
  const response = await request(CLERK_USERS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email_address: [email], password }),
  });
  if (!response.ok) throw new Error(`Temporary recipient creation failed: HTTP ${response.status}.`);
  const user = await response.json();
  const primary = user.email_addresses?.find((item) => item.id === user.primary_email_address_id);
  if (!/^user_[A-Za-z0-9]+$/.test(user.id ?? "") ||
      primary?.email_address?.toLowerCase() !== email.toLowerCase() ||
      primary?.verification?.status !== "verified") {
    throw new Error("Temporary recipient creation returned an unverified or mismatched identity.");
  }
  return { id: user.id, email };
}

export async function deleteTemporaryRecipient({ secretKey, userId, request = fetch }) {
  if (!secretKey?.startsWith("sk_test_") || !/^user_[A-Za-z0-9]+$/.test(userId ?? "")) {
    throw new Error("Temporary recipient cleanup target is invalid.");
  }
  const response = await request(`${CLERK_USERS_URL}/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Temporary recipient cleanup failed: HTTP ${response.status}.`);
  }
}
