import Image from 'next/image';
import styles from './page.module.css';

export default function Home() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <Image className={styles.logo} src="/next.svg" alt="Next.js logo" width={180} height={38} priority />
                <div>
                    <h1>Welcome to the Test Page</h1>
                    <p>If you see this, you&#39;re not banned.</p>
                </div>
            </main>
            <footer className={styles.footer}></footer>
        </div>
    );
}
