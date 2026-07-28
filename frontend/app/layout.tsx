import "./globals.css";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import MuiLink from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

import Providers from "./providers";

export const metadata: Metadata = {
  title: "Actuals",
  description: "Budget variance analysis with an AI analyst.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AppRouterCacheProvider>
          <Providers>
            {/* App shell: pinned header + a single scroll region below it, so
                pages (e.g. the scenario workspace) can lock panes to the
                viewport and scroll them independently. */}
            <Box
              sx={{
                height: "100dvh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <AppBar
                position="static"
                color="inherit"
                elevation={0}
                sx={{
                  flexShrink: 0,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Toolbar sx={{ gap: 1.5, py: 2, minHeight: "auto" }}>
                  <MuiLink
                    href="/scenarios"
                    underline="none"
                    color="inherit"
                    sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: "6px",
                        bgcolor: "primary.main",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      ◆
                    </Box>
                    <Typography variant="subtitle1">Actuals</Typography>
                  </MuiLink>
                </Toolbar>
              </AppBar>
              <Container
                maxWidth={false}
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  maxWidth: 1400,
                  px: { xs: 3, md: 6 },
                  py: { xs: 3, md: 4 },
                }}
              >
                {children}
              </Container>
            </Box>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
