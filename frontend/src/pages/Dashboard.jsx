import { Link } from "react-router-dom";

const dashboardSections = [
  { number: "01", title: "Find EV Rides", description: "Explore rides that fit your route and schedule.", icon: "↗", tone: "mint" },
  { number: "02", title: "My Bookings", description: "Keep your upcoming trips close at hand.", icon: "▤", tone: "peach" },
  { number: "03", title: "My EV Vehicles", description: "Your electric vehicles and battery details.", icon: "ϟ", tone: "blue" },
  { number: "04", title: "Charging Stations", description: "Find a place to charge along the way.", icon: "⌖", tone: "lavender" },
  { number: "05", title: "AI Recommendations", description: "Thoughtful suggestions for your next journey.", icon: "✳", tone: "yellow" }
  ,{ number: "06", title: "My Rides", description: "Offer a ride and manage journeys you are hosting.", icon: "↗", tone: "mint" }
];

export default function Dashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-intro">
          <span className="eyebrow eyebrow-dark"><span className="live-dot" /> YOUR MOBILITY SPACE</span>
          <h1>{greeting}.<br /><span>Where to next?</span></h1>
          <p>Everything you need for a smoother electric journey, all in one place.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun-disc" />
          <div className="road-line road-line-one" />
          <div className="road-line road-line-two" />
          <div className="road-line road-line-three" />
          <div className="leaf-shape leaf-one" />
          <div className="leaf-shape leaf-two" />
          <div className="road-sign"><span>EV</span><i>↗</i></div>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-sections-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow eyebrow-dark">YOUR NEXT STEPS</span>
            <h2 id="dashboard-sections-title">Make the most of the journey.</h2>
          </div>
          <span className="section-count">06 AREAS</span>
        </div>
        <div className="dashboard-grid">
          {dashboardSections.map((section) => {
            const content = (
              <>
              <div className="card-topline"><span>{section.number}</span><span className="card-icon" aria-hidden="true">{section.icon}</span></div>
              <div className="card-copy"><h3>{section.title}</h3><p>{section.description}</p></div>
              {section.title !== "Find EV Rides" && section.title !== "My Rides" && <span className="coming-soon">Coming soon</span>}
              </>
            );
            return ["Find EV Rides", "My Bookings", "My EV Vehicles", "Charging Stations", "AI Recommendations", "My Rides"].includes(section.title) ? (
              <Link className={`dashboard-card tone-${section.tone} dashboard-card-link`} to={section.title === "Find EV Rides" ? "/rides" : section.title === "My Bookings" ? "/bookings" : section.title === "My EV Vehicles" ? "/vehicles" : section.title === "Charging Stations" ? "/charging-stations" : section.title === "AI Recommendations" ? "/recommendations" : "/my-rides"} key={section.number}>
                {content}
              </Link>
            ) : (
              <article className={`dashboard-card tone-${section.tone}`} key={section.number}>
                {content}
              </article>
            );
          })}
        </div>
      </section>
      <section className="dashboard-note"><span className="note-icon">✳</span><p><strong>Your electric journey starts with a good plan.</strong><br />More ways to explore are on their way.</p></section>
    </div>
  );
}
