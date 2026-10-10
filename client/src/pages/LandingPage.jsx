import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const features = [
  { title: "Smart seller dashboard", description: "Track orders, customers, and revenue from a single workspace built for social commerce sellers.", icon: BarChart3 },
  { title: "AI-driven insights", description: "Use practical ML modules for demand forecasting, inventory optimization, customer segmentation, and trend alerts.", icon: Bot },
  { title: "Professional storefronts", description: "Launch lightweight stores with product discovery, WhatsApp sharing, and a polished mobile-first experience.", icon: Store },
  { title: "Secure and scalable", description: "Built on secure auth patterns, protected APIs, billing entitlements, and role-based access control.", icon: ShieldCheck },
];

const plans = [
  { name: "Free", price: "₹0", description: "Perfect to explore the platform", features: ["1 store", "Basic orders", "Core dashboard"], highlight: false },
  { name: "Launch", price: "₹99", description: "Best for new and growing sellers", features: ["Unlimited products", "Inventory tools", "Customer CRM", "Weekly reports"], highlight: true },
  { name: "Scale", price: "₹299", description: "Premium operations and AI growth", features: ["Demand forecasting", "AI insights", "Priority support", "Advanced automation"], highlight: false },
];

const products = [
  { name: "Everyday Tote", price: "₹799" },
  { name: "Classic Shirt", price: "₹999" },
  { name: "Minimal Wallet", price: "₹599" },
  { name: "Ceramic Mug", price: "₹349" },
];

export default function LandingPage() {
  const [activeProduct, setActiveProduct] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveProduct((previous) => (previous + 1) % products.length);
    }, 1800);

    return () => clearInterval(timer);
  }, []);

  const visibleProduct = products[activeProduct];

  return (
    <div className="landing-shell text-[#1e2c23]">
      <header className="landing-topbar">
        <div className="brand-wrap">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">supply<span>link</span></div>
            <div className="brand-tag">SELLER OPERATIONS</div>
          </div>
        </div>

        <nav className="landing-nav">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#insights">AI</a>
        </nav>

        <div className="landing-actions">
          <Link to="/login" className="nav-link-button secondary">Log in</Link>
          <Link to="/register" className="nav-link-button primary">Start free</Link>
        </div>
      </header>

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow-bar">
              <span className="pulse-dot" />
              Built for social sellers
            </div>
            <h1>Launch a premium storefront your customers actually trust.</h1>
            <p>
              Curate better products, publish elevated storefronts, and run a complete social commerce operation with AI insights, managed inventory, and instant WhatsApp ordering built in.
            </p>

            <div className="cta-row">
              <Link to="/register" className="primary-cta">
                Launch my store
                <ArrowRight size={18} />
              </Link>
              <Link to="/dashboard" className="secondary-cta">See the dashboard</Link>
            </div>

            <div className="hero-metrics">
              <div>
                <strong>12k+</strong>
                <span>Orders processed</span>
              </div>
              <div>
                <strong>4.9/5</strong>
                <span>Seller satisfaction</span>
              </div>
              <div>
                <strong>₹3.2L</strong>
                <span>Monthly GMV tracked</span>
              </div>
            </div>
          </div>

          <div className="hero-visual glass-panel">
            <div className="floating-badge">Trending today</div>

            <div className="mini-widget widget-green">
              <div className="widget-topline">
                <span>Revenue</span>
                <span className="live-pill">Live</span>
              </div>
              <strong>₹48,290</strong>
              <em>+12.8% this week</em>
            </div>

            <div className="mini-panel">
              <div className="panel-header">
                <span>Top products</span>
                <TrendingUp size={16} />
              </div>
              <div className="product-list">
                <div className={visibleProduct.name === "Everyday Tote" ? "is-active" : ""}>
                  <span>Everyday Tote</span>
                  <strong>₹799</strong>
                </div>
                <div className={visibleProduct.name === "Classic Shirt" ? "is-active" : ""}>
                  <span>Classic Shirt</span>
                  <strong>₹999</strong>
                </div>
                <div className={visibleProduct.name === "Minimal Wallet" ? "is-active" : ""}>
                  <span>Minimal Wallet</span>
                  <strong>₹599</strong>
                </div>
              </div>
            </div>

            <div className="mini-widget widget-light">
              <span>AI insight</span>
              <strong>{visibleProduct.name}</strong>
              <em>{visibleProduct.price} • trending ahead of plan</em>
            </div>
          </div>
        </section>

        <section className="feature-section" id="features">
          <div className="section-heading">
            <p>WHY SELLERS CHOOSE SUPPLY LINK</p>
            <h2>Everything to run a better store.</h2>
          </div>

          <div className="feature-grid">
            {features.map(({ title, description, icon: Icon }) => (
              <div className="feature-card" key={title}>
                <div className="feature-icon"><Icon size={20} /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pricing-section" id="pricing">
          <div className="section-heading">
            <p>PRICING</p>
            <h2>Simple plans for every stage.</h2>
          </div>

          <div className="pricing-grid">
            {plans.map(({ name, price, description, features, highlight }) => (
              <div className={`plan-card ${highlight ? "plan-highlight" : ""}`} key={name}>
                <div className="plan-name-row">
                  <h3>{name}</h3>
                  {highlight && <span>Popular</span>}
                </div>
                <div className="plan-price">{price}<small>/month</small></div>
                <p>{description}</p>
                <ul>
                  {features.map((feature) => (
                    <li key={feature}><CheckCircle2 size={15} /> {feature}</li>
                  ))}
                </ul>
                <Link to="/register" className={`plan-button ${highlight ? "primary" : "secondary"}`}>
                  {name === "Free" ? "Try free" : "Choose plan"}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="insight-section" id="insights">
          <div className="section-heading">
            <p>AI + MACHINE LEARNING</p>
            <h2>Smarter decisions backed by data.</h2>
          </div>

          <div className="insight-grid">
            <div className="insight-card">
              <div className="insight-icon"><Bot size={18} /></div>
              <h3>Demand forecasting</h3>
              <p>Project future sales using historical demand with better planning for restocking and promotions.</p>
            </div>
            <div className="insight-card">
              <div className="insight-icon"><CreditCard size={18} /></div>
              <h3>Subscription logic</h3>
              <p>Plan validation and access control are enforced on the backend before features are unlocked.</p>
            </div>
            <div className="insight-card">
              <div className="insight-icon"><Sparkles size={18} /></div>
              <h3>Customer intelligence</h3>
              <p>Group repeat buyers, detect product demand shifts, and surface the best growth opportunities.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
