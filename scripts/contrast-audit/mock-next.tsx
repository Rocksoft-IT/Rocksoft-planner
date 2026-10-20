import type { AnchorHTMLAttributes } from 'react'

export const usePathname = () => '/' + (new URLSearchParams(location.search).get('view') ?? 'timeline')
export const useRouter = () => ({ refresh() {}, push() {} })
export default function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} /> }
