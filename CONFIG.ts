const config = {
    // Customize the branding of the viewer by providing a logo and/or name (at least one of them)
    branding:{
        // Path to logo image
        logo_path: "public/CZ-Biohub-SF-RGB-60x60.png",
        // Organization name
        name: "CZ BIOHUB"
    },
  
    // When opening the viewer, or refreshing the page, the viewer will revert to the following default dataset
    data:{
        // Default dataset URL (must be publically accessible)
        default_dataset: "https://sci-imaging-vis-public-demo-data.s3.us-west-2.amazonaws.com/points-web-viewer/sparse-zarr-v2/ZSNS001_tracks_bundle.zarr"
    },
  
    // Default settings for certain parameters
    settings:{
        // Maximum number of cells a user can select without getting a warning
        max_num_selected_cells: 100
    }
}

export default config