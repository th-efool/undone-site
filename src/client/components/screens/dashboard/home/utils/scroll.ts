export function scrollByAmount(element: HTMLElement, amount: number) {
    element.scrollBy({ left: amount, behavior: "smooth" });
}
