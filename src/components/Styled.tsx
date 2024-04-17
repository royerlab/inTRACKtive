import { styled, Typography } from "@mui/material";

import { fontCapsXxs, fontBodyXs, fontBodyS, fontHeaderS, Button } from "@czi-sds/components";

export const Note = styled(Typography)`
    ${fontBodyXs}
`;

export const FontS = styled(Typography)`
    ${fontBodyS}
    margin: 0;
`;

export const SmallCapsButton = styled(Button)`
    ${fontCapsXxs}
    sdsStyle="minimal"
    sdsType="primary"
`;

export const ControlLabel = styled(Typography)`
    ${fontHeaderS}
    margin: 0;
`;
