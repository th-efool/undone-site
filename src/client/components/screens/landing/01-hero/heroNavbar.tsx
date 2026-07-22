"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const navigationItems = [
 { label: "Product", href: "#product" },
 { label: "Cohorts", href: "#cohorts" },
 { label: "Our Philosophy", href: "#philosophy" },
 { label: "Pricing", href: "#pricing" },
];

export function HeroNavbar() {
 const [hovered, setHovered] = useState<string | null>(null);
 return (
     <header
         style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          zIndex: 100,
          padding: "32px 32px",
          boxSizing: "border-box",
         }}
     >
      <div
          style={{
           width: "100%",
           padding: "0 36px",
           display: "flex",
           alignItems: "center",
           justifyContent: "space-between",
          }}
      >
       <Link
           href="/"
           style={{
            display: "flex",
            alignItems: "center",
            gap: 21,
            textDecoration: "none",
            color: "white",
           }}
       >
        <div
            style={{
             width: 70,
             height: 70,
             borderRadius: 22,
             overflow: "hidden",
             border: "2px solid rgba(255,255,255,.92)",
             boxShadow:
                 "0 0 18px rgba(142,92,255,.35), 0 0 48px rgba(255,255,255,.18)",
             flexShrink: 0,
            }}
        >
         <Image
             src="/images/logos/sidequesthq-logo.webp"
             alt="SideQuestHQ"
             width={78}
             height={78}
             priority
         />
        </div>

        <span
            style={{
             fontSize: 32,
             fontWeight: 700,
             letterSpacing: "-0.04em",
             textShadow: "0 3px 18px rgba(0,0,0,.35)",
             lineHeight: 1,
             color: "#fff",
            }}
        >
                        SideQuestHQ
                    </span>
       </Link>

       <nav
           style={{
            display: "flex",
            gap: 42,
            alignItems: "center",
           }}
       >
        {navigationItems.map((item) => (
            <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => setHovered(item.href)}
                onMouseLeave={() => setHovered(null)}
                style={{
                 color:
                     hovered === item.href
                         ? "#ffffff"
                         : "#181818",

                 fontWeight: 650,
                 fontSize: 17,
                 textDecoration: "none",
                 transition: "color .18s ease",
                }}
            >
             {item.label}
            </Link>
        ))}
       </nav>

       <div
           style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
           }}
       >
        <Link
            href="/login"
            style={{
             color: "#151515",
             textDecoration: "none",
             fontWeight: 700,
             fontSize: 18,
            }}
        >
         Log in
        </Link>

        <Link
            href="/signup"
            style={{
             display: "inline-flex",
             alignItems: "center",
             gap: 12,
             padding: "14px 24px",
             borderRadius: 999,
             background: "#15172D",
             color: "#fff",
             textDecoration: "none",
             fontWeight: 800,
             fontSize: 16,
             boxShadow:
                 "0 12px 30px rgba(15,15,40,.22)",
            }}
        >
         Start Your Next SideQuest
         <span>→</span>
        </Link>
       </div>
      </div>
     </header>
 );
}