// Synthetic read-only inputs, never a provider or configured database.
const replies = [
  [{ token: 'review-wrong-account', workspaceId: 'review-orchard', email: 'invited@example.invalid',
    expiresAt: new Date('2027-01-22T12:00:00Z'), acceptedAt: null, acceptedByUserId: null,
    invitedByUserId: 'review-owner' }],
  [{ name: 'The Orchard, events' }],
  [{ name: 'Niamh O’Connell', email: 'owner@example.invalid' }],
  [{ id: 'review-other' }],
];
exports.db = {
  select() {
    return { from() { return { where() {
      if (!replies.length) throw Error('Unexpected review query');
      return Promise.resolve(replies.shift());
    } }; } };
  },
};
exports.currentUser = async () => ({
  id: 'review-other', primaryEmailAddressId: 'primary',
  emailAddresses: [{ id: 'primary', emailAddress: 'other@example.invalid', verification: { status: 'verified' } }],
});
// Keep the actual child button and geometry. Provider interaction is unverified.
exports.SignOutButton = ({ children }) => children;
exports.SiteNav = exports.SiteFooter = () => { throw Error('Render actual local chrome separately'); };
exports.AcceptInviteButton = () => { throw Error('Wrong account must not offer acceptance'); };
exports.assertConsumed = () => { if (replies.length) throw Error('Expected all four preview reads'); };
