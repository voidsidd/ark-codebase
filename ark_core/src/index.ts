import "dotenv/config";
import app from "./server";

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log("Ark Core running at http://localhost:3000");
});
