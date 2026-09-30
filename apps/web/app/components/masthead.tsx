import Image from "next/image";
import styles from "./masthead.module.css";

/**
 * The Smart India Hackathon attribution mark shown at the top of every public
 * page.
 *
 * This is the whole masthead, deliberately. It used to carry the National
 * Emblem of India and the words "Government of India", which told any visitor
 * that Netram is an official government portal. It is not — Netram is a
 * Smart India Hackathon 2026 project, and the SIH mark is the only attribution
 * here that is actually true.
 *
 * There is no product name or tagline either: each page already states it (the
 * login card has its own branding block, the landing page leads with the
 * animated wordmark), and the "not an official platform" wording already lives
 * in the disclaimer modal shown site-wide. Repeating it up here was noise.
 */
export function Masthead() {
  return (
    <div className={styles.masthead}>
      <a
        href="https://sih.gov.in"
        target="_blank"
        rel="noreferrer noopener"
        className={styles.link}
        aria-label="Netram is a Smart India Hackathon project — visit sih.gov.in"
      >
        <Image
          src="/sih-logo.png"
          alt="Smart India Hackathon"
          width={208}
          height={96}
          className={styles.sihLogo}
        />
      </a>
    </div>
  );
}
