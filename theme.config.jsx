export default {
    logo: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Cloud icon from favicon */}
            <img 
                src="/favicon.png" 
                alt="CloudAgent" 
                style={{ width: '24px', height: '24px' }} 
            />
            {/* CloudAgent text matching cloudagent.io brand */}
            <span style={{ fontSize: '1.2rem', fontWeight: 400 }}>
                <span style={{ color: '#2D8CCA' }}>Cloud</span>
                <span style={{ color: '#A0A8B0' }}>Agent</span>
            </span>
        </div>
    ),
    project: {
        link: 'https://github.com/asecurecloud/cloudagent_user_documentation',
    },
    docsRepositoryBase: 'https://github.com/asecurecloud/cloudagent_user_documentation/blob/main',
    footer: {
        text: (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#2D8CCA' }}>Cloud</span>
                <span style={{ color: '#A0A8B0' }}>Agent</span>
                <span style={{ color: '#6B7280' }}> Documentation</span>
            </span>
        ),
    },
    head: (
        <>
            <link rel="icon" type="image/png" href="/favicon.png" />
        </>
    ),
}
