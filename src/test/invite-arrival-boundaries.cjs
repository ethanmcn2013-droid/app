// Request/provider stand-ins for invite-arrival.test.ts only. Deliberately no
// imports: a missing test fixture fails closed rather than using a real client.
const fixture = () => globalThis.__inviteArrival;
Object.defineProperty(exports, "db", { get: () => fixture().db });
exports.ACTIVE_WORKSPACE_COOKIE_NAME = "tasks_active_ws";
exports.currentUser = async () => fixture().user;
exports.getCurrentUser = async () => {
  await fixture().beforeIdentity?.();
  return fixture().user?.id;
};
exports.getCurrentUserOrNull = async () => fixture().user?.id ?? null;
exports.getActiveWorkspaceOrNull = async () => { throw Error("Ambient project lookup"); };
exports.cookies = async () => ({
  get: name => ({ value: fixture().cookies.get(name) }),
  set: (name, value, options) => {
    fixture().cookies.set(name, value);
    fixture().writes.push({ name, value, options });
  },
  delete: name => { throw Error("Unexpected cookie deletion: " + name); },
});
exports.revalidatePath = path => fixture().invalidations.push(path);
exports.sendEmail = () => { throw Error("Email must not be sent"); };
exports.inviteEmailHtml = () => { throw Error("Email must not be composed"); };
exports.SignIn = function SignIn() {};
exports.SignUp = function SignUp() {};
exports.SignOutButton = function SignOutButton() {};
// Exercise the client handler without a DOM renderer. React scheduling and
// Next navigation are boundaries; the handler and server action remain real.
exports.useState = initial => [initial, value => { fixture().clientError = value; }];
exports.useTransition = () => [false, callback => { fixture().transition = callback(); }];
exports.useRouter = () => ({
  push: url => { fixture().navigation = { kind: "push", url }; },
  replace: url => { fixture().navigation = { kind: "replace", url }; },
});
exports.useToast = () => ({ toast: () => {} });
