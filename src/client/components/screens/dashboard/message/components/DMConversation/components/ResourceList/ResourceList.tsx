import { ChevronRight, FileText, Image, Link, Pin } from "lucide-react";
import { DMResource } from "../../../../models";
import styles from "./ResourceList.module.css";
interface Props { resources: DMResource[]; }
const icons = { files: FileText, pin: Pin, media: Image, links: Link };
export function ResourceList({ resources }: Props) {return <section className={styles.card}>{resources.map((resource) => {const Icon = icons[resource.icon]; return <button key={resource.id} type="button"><Icon size={20}/><span>{resource.title}</span><b>{resource.count}</b><ChevronRight size={18}/></button>})}</section>}
