export function getName(): string | null {
    try {
        return localStorage.getItem("name");
    } catch {
        return null;
    }
}

export function setName(name: string) {
    try {
        localStorage.setItem("name", name);
    } catch {
    }
}
