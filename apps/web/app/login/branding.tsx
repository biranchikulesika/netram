import React from "react";
import styles from "./login.module.css";

export function Branding() {
  return (
    <div className={styles.branding}>
      <h1 className={styles.brandTitle}>Netram</h1>
      <p className={styles.brandSubtitle}>Smart real-time monitoring and inspection platform</p>
    </div>
  );
}
