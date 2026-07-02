import "reflect-metadata";
import { validate } from "class-validator";
import { Ifc4AssistantDto } from "./ifc4-assistant.dto";

describe("Ifc4AssistantDto", () => {
  it("accepts large IFC class selections from multipart JSON", async () => {
    const dto = new Ifc4AssistantDto();
    dto.selectedClasses = JSON.stringify(
      Array.from({ length: 1200 }, (_, index) => `IFC_CUSTOM_CLASS_${index.toString().padStart(4, "0")}`)
    );
    dto.selectedProperties = JSON.stringify(
      Array.from({ length: 300 }, (_, index) => `Property_${index.toString().padStart(4, "0")}`)
    );

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
