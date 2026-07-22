"use client";
import { useState } from "react";

export function HeroContent() {
    const [hoveredButton, setHoveredButton] = useState<"demo" | "cta" | null>(null);
    return (
        <section
            style={{
                position: "absolute",
                top: "28%",
                right: "5%",
                width: 760,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                textAlign: "left",
                zIndex: 20,
            }}
        >
            <div
                style={{
                    width: 760,
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "#252533",
                    marginBottom: 22,
                    whiteSpace: "nowrap",
                }}
            >
                BOOKMARKS. WATCH LATER. HALF-FINISHED COURSES. DROPPED HOBBIES.
            </div>

            <h1
                style={{
                    margin: 0,
                    width: 700,

                    fontFamily: "'DM Serif Display', serif",

                    fontSize: 84,
                    fontWeight: 600,
                    lineHeight: 0.92,
                    letterSpacing: "-0.04em",

                    color: "#0D1026",

                    textAlign: "left",
                    textWrap: "balance",
                }}
            >
                Curiosity shouldn't feel like{" "}
                <span
                    style={{
                        color: "#5B39F6",
                    }}
                >
                    a burden.
                </span>
            </h1>

            <p
                style={{
                    marginTop: 28,
                    marginBottom: 0,
                    marginLeft: 95,

                    width: 520,

                    fontSize: 21,
                    lineHeight: 1.55,
                    fontWeight: 500,

                    color: "rgba(26,27,40,.82)",

                    textAlign: "center",
                }}
            >
                Somewhere along the way, your curiosity became another item on
                your to-do list, constantly pushed aside by responsibilities.
            </p>

            <div
                style={{
                    display: "flex",
                    gap: 18,
                    marginTop: 18,
                    marginLeft: 75,
                }}
            >
                <button
                    onMouseEnter={() => setHoveredButton("demo")}
                    onMouseLeave={() => setHoveredButton(null)}
                    style={{
                        height: 60,
                        padding: "0 30px",
                        borderRadius: 999,
                        border: "2px solid #171A31",
                        background:
                            hoveredButton === "demo"
                                ? "#171A31"
                                : "rgba(255,255,255,.82)",
                        backdropFilter: "blur(10px)",
                        fontSize: 18,
                        fontWeight: 700,
                        color:
                            hoveredButton === "demo"
                                ? "#fff"
                                : "#171A31",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer",
                        transition: "all .22s ease",
                        transform:
                            hoveredButton === "demo"
                                ? "translateY(-2px)"
                                : "translateY(0)",
                        boxShadow:
                            hoveredButton === "demo"
                                ? "0 12px 32px rgba(23,26,49,.22)"
                                : "none",
                    }}
                >
    <span
        style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background:
                hoveredButton === "demo"
                    ? "#fff"
                    : "#5B39F6",
            color:
                hoveredButton === "demo"
                    ? "#5B39F6"
                    : "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            transition: "all .22s ease",
        }}
    >
        ▶
    </span>

                    See How It Works
                </button>

                <button
                    onMouseEnter={() => setHoveredButton("cta")}
                    onMouseLeave={() => setHoveredButton(null)}
                    style={{
                        height: 60,
                        padding: "0 34px",
                        borderRadius: 999,
                        border: "none",
                        background:
                            hoveredButton === "cta"
                                ? "linear-gradient(90deg,#6B4DFF 0%,#7C39FF 100%)"
                                : "linear-gradient(90deg,#5B39F6 0%,#6C2BFF 100%)",
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer",
                        transition: "all .22s ease",
                        transform:
                            hoveredButton === "cta"
                                ? "translateY(-2px) scale(1.03)"
                                : "translateY(0) scale(1)",
                        boxShadow:
                            hoveredButton === "cta"
                                ? "0 24px 54px rgba(91,57,246,.48)"
                                : "0 18px 40px rgba(91,57,246,.35)",
                    }}
                >
                    Start Your Next SideQuest
                    <span
                        style={{
                            transition: "transform .22s ease",
                            transform:
                                hoveredButton === "cta"
                                    ? "translateX(4px)"
                                    : "translateX(0)",
                        }}
                    >
                    →
                </span>
                </button>
            </div>

            <div
                style={{
                    marginTop: 18,
                    marginLeft: 180,

                    color: "#5B39F6",

                    fontFamily: "'Caveat', cursive",
                    fontSize: 18,
                    fontWeight: 640,
                    lineHeight: 1.05,

                    transform: "rotate(-3deg)",

                    opacity: 0.95,
                }}
            >
                It only takes 2 minutes.
                <br />
                It'll keep the momentum.
            </div>
        </section>
    );
}