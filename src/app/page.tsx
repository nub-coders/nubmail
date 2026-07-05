import styles from './page.module.css';
import Link from 'next/link';
import { Mail, Globe, ShieldCheck, Key, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Globe,
    title: 'Custom domains',
    desc: 'Point any domain here — DNS verification is automatic.',
  },
  {
    icon: ShieldCheck,
    title: 'Signed, not just sent',
    desc: 'Every message is DKIM-signed and delivered by your own SMTP server.',
  },
  {
    icon: Key,
    title: 'Scoped API keys',
    desc: 'Per-domain, per-account permissions — nothing more than a key needs.',
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
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            Run your own mail server, not someone else&apos;s API
          </h1>
          <p className={styles.heroDesc}>
            SMTP, DKIM signing, and a scoped REST API for every domain you own — self-hosted, not billed per message.
          </p>
          <div className={styles.heroCta}>
            <Button size="lg" className={styles.ctaPrimary} asChild>
              <Link href="/register">Get started</Link>
            </Button>
            <Button size="lg" variant="outline" className={styles.ctaSecondary} asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <div className={styles.proof}>
            <div className={styles.proofLine}>_dkim._domainkey.yourdomain.com&nbsp;&nbsp;TXT</div>
            <div className={styles.proofLineMuted}>v=DKIM1; k=rsa; p=MIGfMA0GCSq...</div>
            <div className={styles.proofVerified}>
              <Check className={styles.proofCheckIcon} />
              Verified
            </div>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.featuresInner}>
          <div className={styles.featuresHeader}>
            <p className={styles.featuresLabel}>Features</p>
            <h2 className={styles.featuresTitle}>Domains, signing, and API access</h2>
            <p className={styles.featuresDesc}>
              The three pieces that make self-hosting worth it.
            </p>
          </div>
          <div className={styles.featuresGrid}>
            {features.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <f.icon className={styles.featureIconSvg} />
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Add your first domain in minutes</h2>
          <p className={styles.ctaDesc}>
            DNS verification, DKIM signing, and SMTP are ready as soon as you connect a domain.
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
            <Link href="/register" className={styles.footerLink}>Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
