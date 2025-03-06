interface DeviceState {
    isTablet: boolean;
    isTabletWithKeyboard: boolean;
    isPhone: boolean;
    isMobile: boolean;
}

function detectDeviceType(): DeviceState {
    const ua = navigator.userAgent || navigator.vendor;

    // Detect iPads, iPhones, and iPods based on the user agent string
    const isiPad =
        /iPad/.test(ua) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
    const isiPhoneOrIPod = /iPhone|iPod/.test(ua);

    // Detect Android phones and tablets
    const isAndroidPhone = /Android/.test(ua) && /Mobile/.test(ua);
    const isAndroidTablet = /Android/.test(ua) && !/Mobile/.test(ua);

    // Screen size check (tablets typically have a wider screen)
    const isSmallScreen = window.screen.width <= 768;
    const hasTouch = navigator.maxTouchPoints > 1;

    // Determine if it's a phone, tablet, or desktop
    const isPhone = isiPhoneOrIPod || isAndroidPhone || isSmallScreen;
    const isTablet = isiPad || isAndroidTablet || hasTouch;
    const isDesktop = !isPhone && !isTablet; // It's a desktop if it's neither a phone nor a tablet

    // Currently using manual overrides for debugging
    // const isPhone = false;
    // const isTablet = true;
    // const isDesktop = false;

    return {
        isPhone,
        isTablet: isTablet && !isPhone,
        isTabletWithKeyboard: false,
        isMobile: !isDesktop,
    };
}

const deviceState = {
    current: detectDeviceType(),
    listeners: new Set<(device: DeviceState) => void>(),

    init() {
        if (this.current.isPhone) {
            window.confirm(
                "Note: for full functionality, please use a tablet or desktop device. Press 'OK' to continue ",
            );
        }

        // // Ensure document has focus for Safari on iPad
        // window.addEventListener(
        //     "touchstart",
        //     () => {
        //         document.body.focus();
        //     },
        //     { once: false },
        // );

        const onKeyboardDetected = () => {
            if (this.current.isTablet) {
                // Only switch if it's a tablet
                this.update({
                    isTablet: false,
                    isTabletWithKeyboard: true,
                    isPhone: false,
                    isMobile: false,
                });
                console.log("Tablet with keyboard detected! Switching to laptop mode...");
            }
        };

        let keyboardDetected = false;
        document.addEventListener("keydown", (event) => {
            const ignoredKeys = ["VolumeUp", "VolumeDown", "Power"];
            if (!keyboardDetected && !ignoredKeys.includes(event.key)) {
                keyboardDetected = true;
                if (this.current.isTablet) {
                    // Only log if it's a tablet
                    console.log("Keyboard detected! Switching to laptop mode...");
                }
                onKeyboardDetected();
            }
        });
    },

    update(newState: DeviceState) {
        this.current = newState;
        this.listeners.forEach((listener) => listener(this.current));
    },

    subscribe(listener: (device: DeviceState) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    },
};

deviceState.init();
export default deviceState;
