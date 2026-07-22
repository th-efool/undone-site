export function HeroContent() {
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
                    style={{
                        height: 60,
                        padding: "0 30px",
                        borderRadius: 999,
                        border: "2px solid #171A31",
                        background: "rgba(255,255,255,.82)",
                        backdropFilter: "blur(10px)",
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#171A31",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer",
                    }}
                >
                    <span
                        style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "#5B39F6",
                            color: "#fff",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 12,
                        }}
                    >
                        ▶
                    </span>

                    See How It Works
                </button>

                <button
                    style={{
                        height: 60,
                        padding: "0 34px",
                        borderRadius: 999,
                        border: "none",
                        background:
                            "linear-gradient(90deg,#5B39F6 0%,#6C2BFF 100%)",
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer",
                        boxShadow: "0 18px 40px rgba(91,57,246,.35)",
                    }}
                >
                    Start Your Next SideQuest
                    <span>→</span>
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