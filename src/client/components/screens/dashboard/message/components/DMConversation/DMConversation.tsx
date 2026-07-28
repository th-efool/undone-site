import { useEffect, useRef, useState } from "react";
import { DMConversationModel } from "../../models";
import { DMComposer } from "./components/DMComposer/DMComposer";
import { DMHeader } from "./components/DMHeader/DMHeader";
import { DMProfileSidebar } from "./components/DMProfileSidebar/DMProfileSidebar";
import { MessageTimeline } from "./components/MessageTimeline/MessageTimeline";
import styles from "./DMConversation.module.css";

interface Props { conversation: DMConversationModel; draft: string; scrollTop: number; onBack(): void; onDraftChange(value: string): void; onScrollChange(scrollTop: number): void; onSend(): void; onUpload(file: File, kind: "image" | "pdf" | "file" | "video" | "audio"): void; }

export function DMConversation({ conversation, draft, scrollTop, onBack, onDraftChange, onScrollChange, onSend, onUpload }: Props) {
    const [aboutOpen, setAboutOpen] = useState(false); const shellRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (!aboutOpen) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setAboutOpen(false); }; const onPointer = (event: MouseEvent) => { const target = event.target as HTMLElement; if (!target.closest("[data-about-panel]") && !target.closest("[data-about-toggle]")) setAboutOpen(false); }; document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onPointer); return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onPointer); }; }, [aboutOpen]);
    return <div className={styles.dm} ref={shellRef}><main className={styles.main}><DMHeader user={conversation.user} onBack={onBack} aboutOpen={aboutOpen} onToggleAbout={() => setAboutOpen((open) => !open)} /><MessageTimeline conversation={conversation} scrollTop={scrollTop} onScrollChange={onScrollChange} /><DMComposer value={draft} onChange={onDraftChange} onSend={onSend} onUpload={onUpload} /></main>{aboutOpen && <DMProfileSidebar conversation={conversation} onClose={() => setAboutOpen(false)} />}</div>;
}
