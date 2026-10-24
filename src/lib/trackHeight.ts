/**
 * Keeps a CSS variable on <html> at an element's real height (border included), so pages can
 * offset their content by fixed bars. A ResizeObserver catches every change, e.g. a bar hiding
 * when the layout goes wide. Returns the cleanup, which resets the variable to 0.
 */
export const trackHeight = (el: HTMLElement, name: string) => {
	const update = () => document.documentElement.style.setProperty(name, `${el.offsetHeight}px`);
	const observer = new ResizeObserver(update);
	observer.observe(el);
	update();
	return () => {
		observer.disconnect();
		document.documentElement.style.setProperty(name, "0px");
	};
};
