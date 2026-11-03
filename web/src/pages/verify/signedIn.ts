// Whether the person on the Verify page is signed in. Signed out on the public page, our
// strategies and our daily prices (both behind sign-in) are left out, and the result says
// what that leaves unchecked.
import { createContext } from "react";

export const SignedIn = createContext(true);
