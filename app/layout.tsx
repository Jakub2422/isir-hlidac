import type {Metadata} from 'next';import Link from 'next/link';import './globals.css';
export const metadata:Metadata={title:'ISIR Reality MSK',description:'Nové nemovitosti v insolvenčních dokumentech Moravskoslezského kraje',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="cs"><body><nav className="shell" aria-label="Monitoring majitele"><Link href="/upozorneni">Upozornění</Link>{' · '}<Link href="/zdroje">Zdraví zdrojů</Link></nav>{children}</body></html>}
