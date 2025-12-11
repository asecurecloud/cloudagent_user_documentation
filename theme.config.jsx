export default {
    // Logo with CloudAgent branding - matches main site header style
    logo: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/favicon.png" alt="CloudAgent" style={{ height: '24px' }} />
            <span style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'baseline' }}>
                <span style={{ color: '#4a90c2' }}>Cloud</span>
                <span style={{ color: '#b0bec5' }}>Agent</span>
            </span>
            <span style={{ color: '#4b5563', fontWeight: 500, fontSize: '14px', marginLeft: '4px', alignSelf: 'flex-end', marginBottom: '2px' }}>Docs</span>
        </div>
    ),
    // Favicon configuration
    head: (
        <>
            <link rel="icon" type="image/png" href="/favicon.png" />
            <link rel="apple-touch-icon" href="/favicon.png" />
        </>
    ),
    project: {
        link: 'https://github.com/asecurecloud/cloudagent_user_documentation',
    },
    docsRepositoryBase: 'https://github.com/asecurecloud/cloudagent_user_documentation/blob/main',
    footer: {
        text: 'CloudAgent Documentation',
    },
}
