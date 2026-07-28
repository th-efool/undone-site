import {Hero} from "@/src/client/components/screens/landing/01-hero"
import {Ikigai} from "@/src/client/components/screens/landing/02-ikigai";
import {Problem} from "@/src/client/components/screens/landing/03-problem";
import {Community} from "@/src/client/components/screens/landing/04-community";
import {Features} from "@/src/client/components/screens/landing/05-Features"
import {Footer} from "@/src/client/components/screens/landing/06-footer";

export default function landing(){
    return (
        <main className="overflow-x-hidden">
            <Hero/>
            <Ikigai/>
            {/*<Problem/>
            <Community/>
            <Features/> */}
            <Footer/>
        </main>
    )
}
