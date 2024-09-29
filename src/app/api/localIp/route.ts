import os from "node:os";

export function GET() {
  try {
    const interfaces = os.networkInterfaces();

    for (const interfaceName in interfaces) {
      const addresses = interfaces[interfaceName];

      if (!addresses) {
        continue;
      }

      for (const address of addresses) {
        if (address.family === "IPv4" && !address.internal) {
          return new Response(
            JSON.stringify({ success: true, address: address.address }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }
      }
    }
  } catch (error) {
    console.error("Error to Local IP", error);
    return new Response(JSON.stringify({ success: false, error: error }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
