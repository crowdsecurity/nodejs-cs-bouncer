import styles from './page.module.css';

export default function Home() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold">Welcome to the Test Page</h1>
                    <p className="text-green-400 p-4 border rounded-lg">If you see this, you&#39;re not banned.</p>
                </div>
            </main>
        </div>
    );
}
