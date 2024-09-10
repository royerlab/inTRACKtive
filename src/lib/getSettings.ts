export async function loadDefaultData() {
    try {
        const response = await fetch("./CONFIG.json");
        const json = await response.json();
        const defaultDataset = json.data?.default_dataset || "Default dataset";
        console.log("default_dataset = %s", defaultDataset);
        return defaultDataset;
    } catch (error) {
        console.error("Error loading JSON:", error);
        return "Default Dataset";
    }
}

export async function loadBranding() {
    try {
        const response = await fetch("./CONFIG.json");
        const json = await response.json();
        const name: string = json.branding?.name || "Default name";
        const logoPath: string = json.branding?.logo_path || "default/logo/path.png";
        console.log("branding name = %s", name);
        console.log("branding logo_path = %s", logoPath);
        return [name, logoPath];
    } catch (error) {
        console.error("Error loading JSON:", error);
        return [undefined, undefined];
    }
}
