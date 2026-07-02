import styles from './page.module.css';
import Link from 'next/link';
import { Mail, Shield, Globe, Key, Zap, Code, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Globe,
    title: 'Custom Domains',
    desc: 'Use your own domain names for professional email addresses. Full DNS management with automated verification.',
  },
  {
    icon: Shield,
    title: 'DKIM Signing',
    desc: 'Every outgoing email is signed with DKIM to ensure deliverability and protect against spoofing.',
  },
  {
    icon: Send,
    title: 'Built-in SMTP',
    desc: 'Fully managed SMTP server. Send and receive emails without any third-party dependencies.',
  },
  {
    icon: Key,
    title: 'API Access',
    desc: 'Scoped API keys with granular permissions. Control which domains and accounts each key can access.',
  },
  {
    icon: Zap,
    title: 'Fast & Reliable',
    desc: 'Lightweight architecture built for speed. Your emails are delivered quickly and reliably.',
  },
  {
    icon: Code,
    title: 'Developer Friendly',
    desc: 'RESTful API for sending, reading, and managing emails programmatically. Perfect for automations.',
  },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <Mail className={styles.logoIconSvg} />
            </div>
            <span className={styles.logoText}>NubMail</span>
          </div>
          <div className={styles.navLinks}>
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.badge}>
            <Mail className="h-4 w-4" />
            Self-hosted email made simple
          </div>
          <h1 className={styles.heroTitle}>
            Professional email for{' '}
            <span className={styles.heroGradient}>your custom domains</span>
          </h1>
          <p className={styles.heroDesc}>
            Send, receive, and manage emails with your own domain. Built-in SMTP server, DKIM signing, granular API access, and a clean dashboard — all in one self-hosted package.
          </p>
          <div className={styles.heroCta}>
            <Button size="lg" className={styles.ctaPrimary} asChild>
              <Link href="/register">Start for free</Link>
            </Button>
            <Button size="lg" variant="outline" className={styles.ctaSecondary} asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.featuresInner}>
          <div className={styles.featuresHeader}>
            <p className={styles.featuresLabel}>Features</p>
            <h2 className={styles.featuresTitle}>Everything you need for email</h2>
            <p className={styles.featuresDesc}>
              A complete email solution with domain management, SMTP, and developer tools built in.
            </p>
          </div>
          <div className={styles.featuresGrid}>
            {features.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <f.icon className={styles.featureIconSvg} />
                </div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Ready to take control of your email?</h2>
          <p className={styles.ctaDesc}>
            Create an account and add your first domain in minutes.
          </p>
          <div className={styles.ctaButtons}>
            <Button size="lg" className={styles.ctaPrimary} asChild>
              <Link href="/register">Get started</Link>
            </Button>
            <Button size="lg" variant="outline" className={styles.ctaSecondary} asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.footerText}>
            &copy; {new Date().getFullYear()} NubMail. All rights reserved.
          </p>
          <div className={styles.footerLinks}>
            <Link href="/login" className={styles.footerLink}>Sign in</Link>
            <Link href="/register" className={styles.footerLink}>Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
