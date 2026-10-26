import { Outlet } from "react-router-dom";
import Brand from "../components/Brand.jsx";

export default function AuthLayout() {
  return (
    <main className="auth-shell">
      <aside className="auth-aside">
        <Brand />
        <div className="aside-copy">
          <span className="eyebrow"><span className="live-dot" /> ELECTRIC MOBILITY, MADE SIMPLE</span>
          <h1>Go farther.<br /><span>Choose electric.</span></h1>
          <p>Find a better way to get there, with a little more care for the road ahead.</p>
        </div>
        <div className="aside-bottom" aria-hidden="true">
          <span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" />
          <span className="aside-caption">A smarter journey starts here.</span>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        <Outlet />
        <p className="auth-footnote">A calmer, cleaner way to move.</p>
      </section>
    </main>
  );
}
