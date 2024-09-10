export async function load_default_data() {
    try {
        const response = await fetch('./CONFIG.json');
        const json = await response.json();
        let default_dataset = json.data?.default_dataset || 'Default dataset';
        console.log('default_dataset = %s', default_dataset);
        return default_dataset
    } catch (error) {
        console.error('Error loading JSON:', error);
        return 'Default Dataset';
    }
}

export async function load_branding() {
    try {
        const response = await fetch('./CONFIG.json');
        const json = await response.json();
        let name: string = json.branding?.name || 'Default name';
        let logo_path: string = json.branding?.logo_path || 'default/logo/path.png';
        console.log('branding name = %s', name);
        console.log('branding logo_path = %s', logo_path);
        return [name, logo_path]
    } catch (error) {
        console.error('Error loading JSON:', error);
        return [undefined, undefined];
    }
}