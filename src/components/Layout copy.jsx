import Header from './Header';
import Footer from './Footer';

function Layout({ children, pageTitle, pageSubtitle }) {
    return (
        <>
            <div style={{ 
                position: 'sticky', 
                top: 0, 
                zIndex: 100,
                backgroundColor: 'transparent',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
                <Header title={pageTitle} subtitle={pageSubtitle} />
            </div>
            <main style={{ paddingBottom: '80px' }}> {/* Space for bottom nav */}
                {children}
            </main>
            <Footer />
        </>
    );
}

export default Layout;