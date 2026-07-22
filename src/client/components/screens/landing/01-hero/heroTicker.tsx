import Image from "next/image";

const avatars = ["a", "b", "c", "d", "e"];

export function HeroTicker() {
    return (
        <div
            style={{
                position: "absolute",
                bottom: 34,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 25,

                display: "flex",
                alignItems: "center",
                gap: 34,

                color: "#fff",
            }}
        >
            {/* Avatars */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                }}
            >
                {avatars.map((avatar, index) => (
                    <div
                        key={avatar}
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: "50%",
                            overflow: "hidden",
                            border: "3px solid rgba(255,255,255,.96)",
                            marginLeft: index === 0 ? 0 : -10,
                            boxShadow: "0 4px 14px rgba(0,0,0,.18)",
                            background: "#fff",
                        }}
                    >
                        <Image
                            src={`/images/landing/${avatar}.webp`}
                            alt=""
                            width={42}
                            height={42}
                        />
                    </div>
                ))}
            </div>

            {/* Learners */}
            <div
                style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "rgba(255,255,255,.96)",
                    whiteSpace: "nowrap",
                }}
            >
                250K+ learners already on their journey
            </div>

            {/* Rating */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    whiteSpace: "nowrap",
                }}
            >
                <span
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#fff",
                    }}
                >
                    4.9
                </span>

                <div
                    style={{
                        display: "flex",
                        gap: 5,
                        color: "#F7C948",
                        fontSize: 20,
                        lineHeight: 1,
                    }}
                >
                    ★★★★★
                </div>
            </div>
        </div>
    );
}