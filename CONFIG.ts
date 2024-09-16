const config = {
    // Customize the branding of the viewer by providing a logo and/or name (at least one of them)
    branding:{
        // Path to logo image (assumes logo is in /public directory)
        logo_path: "/CZ-Biohub-SF-RGB-60x60.png",
        // Organization name
        name: "CZ BIOHUB"
    },
  
    // When opening the viewer, or refreshing the page, the viewer will revert to the following default dataset
    data:{
        // Default dataset URL (must be publically accessible)
        default_dataset: "https://public.czbiohub.org/royerlab/zoo/Ascidian/tracks_withSize_bundle.zarr/"
    },
  
    // Default settings for certain parameters
    settings:{
        // Maximum number of cells a user can select without getting a warning
        max_num_selected_cells: 100,
        // Choose colormap for the tracks, options: viridis-inferno, magma-inferno, inferno-inferno
        colormap_tracks: "viridis-inferno",
        // Point size (arbitrary units)
        point_size: 30
    }
}

export default config
