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
        default_dataset: "https://public.czbiohub.org/royerlab/zoo/Zebrafish/tracks_centered_iso_bundle.zarr/"
    },
  
    // Default settings for certain parameters
    settings:{
        // Maximum number of cells a user can select without getting a warning
        max_num_selected_cells: 100,
        
        // Choose colormap for the tracks, options: viridis-inferno, magma-inferno, inferno-inferno, plasma-inferno, cividis-inferno [default]
        colormap_tracks: "cividis-inferno",
        
        // Point size (arbitrary units), if cell sizes not provided in zarr attributes
        point_size: 0.1,

        // Point color (not selected)
        point_color: [0, 0.8, 0.8], //cyan

        // Point color (when selected)
        highlight_point_color: [0.9, 0, 0.9], //pink

        // Point color (when selector hovers over)
        preview_hightlight_point_color: [0.8, 0.8, 0], //yellow

    }
}

export default config
