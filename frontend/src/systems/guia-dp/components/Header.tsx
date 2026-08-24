import styles from './Header.module.css';
import logoUrl from '../assets/logo-mendonca-galvao.png';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img
          className={styles.logo}
          src={logoUrl}
          alt="Mendonça Galvão Contadores Associados"
          width={195}
          height={131}
        />
        <div className={styles.titles}>
          <span className={styles.subtitle}>Guia do Departamento Pessoal</span>
        </div>
      </div>
    </header>
  );
}
