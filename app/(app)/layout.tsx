import { AdminHeader } from "@/components/admin/AdminHeader"
import {Providers} from '@/components/providers/Providers'


export default function AppLayout({children}: {children : React.ReactNode}){
    return(
      <Providers>
         <div className="min-h-screen flex flex-col">
         <AdminHeader/>
        <main>
            {children}
        </main>
       </div>
      </Providers>
    )
}