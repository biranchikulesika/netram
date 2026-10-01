import React from "react";
import styles from "./login.module.css";

export function Branding() {
  return (
    <div className={styles.branding}>
      <h1 className={styles.brandTitle}>NETRAM</h1>
      <p className={styles.brandSubtitle}>Smart Real-Time Monitoring &amp; Inspection Platform</p>
    </div>
  );
}
