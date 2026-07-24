"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import styles from "./authInput.module.css";

type AuthInputProps = {
    label: string;
    type?: "text" | "email" | "password";
    placeholder: string;
};

export function AuthInput({
                              label,
                              type = "text",
                              placeholder,
                          }: AuthInputProps) {
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = type === "password";

    return (
        <label className={styles.field}>


            <div className={styles.inputWrapper}>
                <input
                    className={styles.input}
                    type={
                        isPassword
                            ? showPassword
                                ? "text"
                                : "password"
                            : type
                    }
                    placeholder={placeholder}
                />

                {isPassword && (
                    <button
                        type="button"
                        className={styles.toggle}
                        onClick={() =>
                            setShowPassword((v) => !v)
                        }
                    >
                        {showPassword ? (
                            <EyeOff size={18} />
                        ) : (
                            <Eye size={18} />
                        )}
                    </button>
                )}
            </div>
        </label>
    );
}