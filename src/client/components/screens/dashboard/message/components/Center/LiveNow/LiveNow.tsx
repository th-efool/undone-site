import { HorizontalScroller } from "@/src/client/components/global/HorizontalScroller";
import { ChevronRight } from "lucide-react";
import { LiveSession } from "../../../models";
import { LiveCard } from "../LiveCard/LiveCard";
import styles from "./LiveNow.module.css";
interface Props{items:LiveSession[];}
export function LiveNow({items}:Props){return <section className={styles.section}><header><h2>Live Now</h2><button type="button">View all <ChevronRight size={18}/></button></header><HorizontalScroller className={styles.scroller} scrollAmount={460}>{items.map((item)=><LiveCard key={item.id} session={item}/>)}</HorizontalScroller></section>}
