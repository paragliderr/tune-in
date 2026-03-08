import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // If user clicked a link (PUSH), scroll to top
    if (navigationType === "PUSH") {
      window.scrollTo(0, 0);
    }

    // If user used back/forward (POP), do nothing
    // Browser will restore previous scroll automatically
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;
