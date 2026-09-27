import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'ISIR Reality MSK',description:'Nové nemovitosti v insolvenčních dokumentech Moravskoslezského kraje',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="cs"><body>{children}</body></html>}
